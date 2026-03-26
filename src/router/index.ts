import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: {
      title: '登录'
    }
  },
  {
    path: '/official',
    name: 'Official',
    component: () => import('../views/HomeWeb/index.vue'),
    meta: {
      title: '官网首页'
    }
  },
  {
    path: '/',
    component: () => import('../layout/index.vue'),
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('../views/Home.vue'),
        meta: {
          title: '首页'
        }
      },
      {
        path: 'about',
        name: 'About',
        component: () => import('../views/About.vue'),
        meta: {
          title: '关于'
        }
      },
      {
        path: 'map',
        name: 'Map',
        component: () => import('../views/Map/index.vue'),
        meta: {
          title: '地图'
        }
      },
      {
        path: 'drag',
        name: 'Drag',
        component: () => import('../views/Drag/index.vue'),
        meta: {
          title: '拖拽'
        }
      },
      {
        path: 'scroll',
        name: 'Scroll',
        component: () => import('../views/Scroll/index.vue'),
        meta: {
          title: '滚动'
        }
      },
    ]
  },
  // 匹配所有未定义路由重定向到首页
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 简单的前置路由守卫
router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '管理系统'} - Vue Test`
  // 实际项目中这里可以判断 token
  // if (to.path !== '/login' && !localStorage.getItem('token')) {
  //   next('/login')
  // } else {
  next()
  // }
})

export default router
