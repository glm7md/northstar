(function () {
    'use strict';

    const API_BASE = 'https://northstar-production-3fbc.up.railway.app/api';
    const TOKEN_KEY = 'northstar_token';
    const USER_KEY = 'northstar_user_cache';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setSession(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function clearSession() {
        const token = getToken();
        if (token) {
            fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {});
        }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    function getCachedUser() {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function isLoggedIn() {
        return Boolean(getToken());
    }

    function isAdmin() {
        const user = getCachedUser();
        return Boolean(user && user.role === 'admin');
    }

    function isStudent() {
        const user = getCachedUser();
        return Boolean(user && user.role === 'student');
    }

    function logout() {
        clearSession();
        window.location.href = '/index.html';
    }

    class ApiError extends Error {
        constructor(message, status, details) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.details = details;
        }
    }

    async function request(method, path, body) {
        const headers = {};
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        if (body !== undefined) headers['Content-Type'] = 'application/json';

        let response;
        try {
            response = await fetch(`${API_BASE}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
        } catch (networkErr) {
            throw new ApiError('Unable to reach the server. Please check your connection and try again.', 0);
        }

        let payload = null;
        try {
            payload = await response.json();
        } catch {
        }

        if (response.status === 401 && token) {
            clearSession();
        }

        if (!response.ok || !payload || payload.ok === false) {
            const message = (payload && payload.error) || `Request failed (${response.status}).`;
            throw new ApiError(message, response.status, payload && payload.details);
        }

        return payload;
    }

    const get = (path) => request('GET', path);
    const post = (path, body) => request('POST', path, body ?? {});
    const put = (path, body) => request('PUT', path, body ?? {});
    const del = (path) => request('DELETE', path);

    async function login(identifier, password) {
        const { token, user } = await post('/auth/login', { identifier, password });
        setSession(token, user);
        return user;
    }

    async function fetchMe() {
        const { user } = await get('/auth/me');
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        return user;
    }

    const Courses = {
        listByYear: (year) => get(`/courses?year=${encodeURIComponent(year)}`).then((r) => r.courses),
        get: (courseId) => get(`/courses/${courseId}`).then((r) => r.course),
        getLecture: (courseId, lectureId) => get(`/courses/${courseId}/lectures/${lectureId}`),
    };

    const Quiz = {
        get: (courseId, lectureId) => get(`/courses/${courseId}/lectures/${lectureId}/quiz`),
        submit: (courseId, lectureId, answers) =>
            post(`/courses/${courseId}/lectures/${lectureId}/quiz/attempts`, { answers }).then((r) => r.attempt),
        getAttempt: (attemptId) => get(`/quiz-attempts/${attemptId}`).then((r) => r.attempt),
        myAttempts: () => get('/students/me/quiz-attempts').then((r) => r.attempts),
    };

    const Me = {
        get: () => get('/students/me').then((r) => r.student),
    };

    const Admin = {
        listCourses: (year) => get(`/admin/courses${year ? `?year=${encodeURIComponent(year)}` : ''}`).then((r) => r.courses),
        getCourse: (courseId) => get(`/admin/courses/${courseId}`).then((r) => r.course),
        createCourse: (data) => post('/admin/courses', data).then((r) => r.course),
        updateCourse: (courseId, data) => put(`/admin/courses/${courseId}`, data).then((r) => r.course),
        deleteCourse: (courseId) => del(`/admin/courses/${courseId}`),

        createLecture: (courseId, data) => post(`/admin/courses/${courseId}/lectures`, data).then((r) => r.lecture),
        updateLecture: (courseId, lectureId, data) =>
            put(`/admin/courses/${courseId}/lectures/${lectureId}`, data).then((r) => r.lecture),
        deleteLecture: (courseId, lectureId) => del(`/admin/courses/${courseId}/lectures/${lectureId}`),

        upsertQuiz: (courseId, lectureId, quiz) =>
            put(`/admin/courses/${courseId}/lectures/${lectureId}/quiz`, quiz).then((r) => r.quiz),
        deleteQuiz: (courseId, lectureId) => del(`/admin/courses/${courseId}/lectures/${lectureId}/quiz`),

        listStudents: () => get('/admin/students').then((r) => r.students),
        createStudent: (data) => post('/admin/students', data).then((r) => r.student),
        updateStudent: (studentId, data) => put(`/admin/students/${studentId}`, data).then((r) => r.student),
        deleteStudent: (studentId) => del(`/admin/students/${studentId}`),
        updateEnrollment: (studentId, courseIds) =>
            put(`/admin/students/${studentId}/enrollment`, { courseIds }).then((r) => r.student),

        listAttempts: (courseId, lectureId) => get(`/admin/courses/${courseId}/lectures/${lectureId}/attempts`),
        publishScore: (attemptId, finalScore) =>
            put(`/admin/quiz-attempts/${attemptId}/publish`, { finalScore }).then((r) => r.attempt),

        gradesByYear: (year) => get(`/admin/grades?year=${encodeURIComponent(year)}`).then((r) => r.students),
    };

    async function uploadFile(file, path) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        formData.append('path', path || 'uploads');

        const headers = {};
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${API_BASE}/storage/upload`, {
            method: 'POST',
            headers,
            body: formData,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
            throw new ApiError(payload.error || `Upload failed (${response.status}).`, response.status);
        }
        return payload.publicUrl;
    }

    function requireStudent() {
        if (!isLoggedIn() || !isStudent()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    function requireAdmin() {
        if (!isLoggedIn() || !isAdmin()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    window.NorthstarAPI = {
        ApiError,
        login,
        logout,
        clearSession,
        fetchMe,
        getToken,
        getCachedUser,
        isLoggedIn,
        isAdmin,
        isStudent,
        requireStudent,
        requireAdmin,
        uploadFile,
        Courses,
        Quiz,
        Me,
        Admin,
    };

    function placeLayoutFooter() {
        const layout = document.querySelector('.shell, .admin-shell');
        const contentColumn = layout
            ? layout.querySelector('.main, .admin-main')
            : document.querySelector('.year-selection-page, .admin-login-page');
        if (!contentColumn) return;

        let footer = document.querySelector('.site-footer');
        const footerTextFixed = '© 2026 Dr. Maged. All Rights Reserved.';
        if (!footer) {
            footer = document.createElement('footer');
            footer.className = 'site-footer';
            footer.textContent = footerTextFixed;
        }
        if (footer.textContent !== footerTextFixed) footer.textContent = footerTextFixed;
        if (footer.parentElement !== contentColumn) contentColumn.appendChild(footer);
        return;

        /*
        if (!footer) {
            footer = document.createElement('footer');
            footer.className = 'site-footer';
            footer.textContent = '© 2026 دكتور ماجد. جميع الحقوق محفوظة.';
        }

        footer.textContent = '© 2026 دكتور ماجد. جميع الحقوق محفوظة.';

        const footerText = '© 2026 Dr. Maged. All Rights Reserved.';
        if (footer.textContent !== footerText) footer.textContent = footerText;

        if (footer.parentElement !== contentColumn) {
            contentColumn.appendChild(footer);
        }
        */
    }

    const footerLayoutObserver = new MutationObserver(placeLayoutFooter);
    footerLayoutObserver.observe(document.body, { childList: true, subtree: true });
    placeLayoutFooter();

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'A') {
            e.preventDefault();
        }
    });

    document.addEventListener('keydown', (e) => {
        const key = (e.key || '').toLowerCase();
        const ctrlOrCmd = e.ctrlKey || e.metaKey;

        if (e.key === 'F12') { e.preventDefault(); return; }
        if (ctrlOrCmd && e.shiftKey && ['i', 'j', 'c'].includes(key)) { e.preventDefault(); return; }
        if (ctrlOrCmd && key === 'u') { e.preventDefault(); return; }
        if (e.key === 'PrintScreen') { e.preventDefault(); }
    });

})();
