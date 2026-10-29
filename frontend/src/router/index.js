/**
 * 桌面网页端路由：定义页面映射与登录访问控制。
 */

import { createRouter, createWebHistory } from 'vue-router'
import {
  getToken,
  getUsername,
  getRefreshToken,
  getAvatar,
  getNickname,
} from '../stores/storage.js'
import { isAllowedSiteReturn, redirectToSiteIfNeeded } from '../utils/siteReturn.js'

const router = createRouter({
  history: createWebHistory('/h5/'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { guest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { guest: true },
    },
    {
      path: '/auth-bridge',
      name: 'auth-bridge',
      component: () => import('../views/AuthBridgeView.vue'),
      meta: { bridge: true },
    },
    {
      path: '/',
      component: () => import('../layouts/AppShell.vue'),
      meta: { auth: true },
      children: [
        { path: '', redirect: { name: 'tasks' } },
        {
          path: 'tasks',
          name: 'tasks',
          component: () => import('../views/TasksView.vue'),
          meta: { titleKey: 'todos.title' },
        },
        {
          path: 'notes',
          name: 'notes',
          component: () => import('../views/NotesView.vue'),
          meta: { titleKey: 'notes.title' },
        },
        {
          path: 'calendar',
          name: 'calendar',
          component: () => import('../views/CalendarView.vue'),
          meta: { titleKey: 'calendar.title' },
        },
        {
          path: 'stats',
          name: 'stats',
          component: () => import('../views/StatsView.vue'),
          meta: { titleKey: 'stats.title' },
        },
        {
          path: 'report',
          name: 'report',
          component: () => import('../views/ReportView.vue'),
          meta: { titleKey: 'report.title' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('../views/ProfileView.vue'),
          meta: { titleKey: 'profile.title' },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('../views/NotificationsView.vue'),
          meta: { titleKey: 'notif.title' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: () => (getToken() ? { name: 'tasks' } : { name: 'login' }),
    },
  ],
})

router.beforeEach(async (to) => {
  // Website logout handoff: clear PC session before guest guard runs
  if (to.name === 'login' && to.query.logout === '1' && getToken()) {
    const { leaveSession } = await import('../stores/auth.js')
    await leaveSession()
  }
  if (to.meta.bridge) return true
  const authed = !!getToken()
  if (to.meta.auth && !authed) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.guest && authed) {
    // Already signed in on H5 — still honor website return URL
    if (
      (to.name === 'login' || to.name === 'register') &&
      isAllowedSiteReturn(to.query.redirect) &&
      redirectToSiteIfNeeded(to.query.redirect, {
        username: getUsername(),
        access_token: getToken(),
        refresh_token: getRefreshToken(),
        nickname: getNickname(),
        avatar: getAvatar(),
      })
    ) {
      return false
    }
    return { name: 'tasks' }
  }
  return true
})

router.afterEach((to) => {
  if (typeof window.gtag !== 'function') return
  window.gtag('config', 'G-Y6BDPDRCN4', {
    page_path: to.fullPath,
  })
})

export default router
