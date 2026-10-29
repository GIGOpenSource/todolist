/**
 * 管理后台路由：定义管理页面、权限元数据与访问控制。
 */

import { createRouter, createWebHistory } from 'vue-router'
import { getToken, getUser } from '../stores/storage.js'
import { firstAllowedRoute, hasPermission } from '../utils/permissions.js'
import AdminLayout from '../layouts/AdminLayout.vue'
import LoginView from '../views/LoginView.vue'
import StatsView from '../views/StatsView.vue'
import UsersView from '../views/UsersView.vue'
import TodosView from '../views/TodosView.vue'
import NotesView from '../views/NotesView.vue'
import LlmModelsView from '../views/LlmModelsView.vue'
import AdminsView from '../views/AdminsView.vue'
import SiteConfigView from '../views/SiteConfigView.vue'
import NotificationsView from '../views/NotificationsView.vue'

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/',
      component: AdminLayout,
      children: [
        { path: '', redirect: () => ({ name: firstAllowedRoute(getUser()) }) },
        { path: 'stats', name: 'stats', component: StatsView, meta: { permission: 'stats' } },
        { path: 'users', name: 'users', component: UsersView, meta: { permission: 'users' } },
        { path: 'todos', name: 'todos', component: TodosView, meta: { permission: 'todos' } },
        { path: 'notes', name: 'notes', component: NotesView, meta: { permission: 'notes' } },
        {
          path: 'llm-models',
          name: 'llm-models',
          component: LlmModelsView,
          meta: { permission: 'llm' },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: NotificationsView,
          meta: { permission: 'notifications' },
        },
        {
          path: 'site-config',
          name: 'site-config',
          component: SiteConfigView,
          meta: { permission: 'site' },
        },
        { path: 'admins', name: 'admins', component: AdminsView, meta: { permission: 'admins' } },
      ],
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.public) {
    if (getToken() && getUser()?.role === 'admin' && to.name === 'login') {
      return { name: firstAllowedRoute(getUser()) }
    }
    return true
  }
  if (!getToken() || getUser()?.role !== 'admin') {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  const need = to.meta.permission
  if (need && !hasPermission(getUser(), need)) {
    return { name: firstAllowedRoute(getUser()) }
  }
  return true
})

export default router
