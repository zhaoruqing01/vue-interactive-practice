<template>
  <el-container class="layout-container">
    <!-- 添加动态宽度绑定 -->
    <el-aside :width="isCollapse ? '64px' : '200px'" class="aside">
      <div class="logo">
        <!-- 折叠时显示简称或图标 -->
        {{ isCollapse ? '系统' : '交互练习系统' }}
      </div>
      <el-menu
        :default-active="route.path"
        class="el-menu-vertical"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
        router
        :collapse="isCollapse"
        :unique-opened="true"
      >
        <template v-for="item in menuRoutes" :key="item.path">
          <!-- 判断是否有子路由 -->
          <el-sub-menu v-if="item.children && item.children.length > 0" :index="`/${item.path}`">
            <template #title>
              <el-icon><Menu /></el-icon>
              <span>{{ item.meta?.title }}</span>
            </template>
            <!-- 遍历子路由 -->
            <el-menu-item 
              v-for="child in item.children" 
              :key="child.path" 
              :index="`/${item.path}/${child.path}`"
            >
              <el-icon><Document /></el-icon>
              <span>{{ child.meta?.title }}</span>
            </el-menu-item>
          </el-sub-menu>
          
          <!-- 无子路由的直接显示 -->
          <el-menu-item v-else :index="`/${item.path}`">
            <el-icon><Menu /></el-icon>
            <span>{{ item.meta?.title }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <!-- 添加折叠按钮 -->
        <div class="header-left">
          <el-icon class="collapse-icon" @click="toggleCollapse">
            <Expand v-if="isCollapse" />
            <Fold v-else />
          </el-icon>
        </div>
        <div class="header-right">
          <span style="margin-right: 15px">{{
            userStore.userInfo.username
          }}</span>
          <el-button type="danger" size="small" @click="handleLogout"
            >退出登录</el-button
          >
        </div>
      </el-header>
      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { useUserStore } from "@/store/user";
import { Menu, Document, Expand, Fold } from "@element-plus/icons-vue";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

// 实例化用户模块
const userStore = useUserStore();

const route = useRoute();
const router = useRouter();
console.log(router, "router");

// 添加折叠状态
const isCollapse = ref(false);

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value;
};

// 获取主布局下的子路由作为菜单
const menuRoutes = computed(() => {
  const rootRoute = router.options.routes.find((r) => r.path === "/");
  return rootRoute?.children || [];
});

const handleLogout = () => {
  userStore.clearUserInfo();
  router.push("/login");
};
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.aside {
  background-color: #304156;
  color: white;
  transition: width 0.3s; /* 添加过渡效果 */
}

.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  border-bottom: 1px solid #1f2d3d;
  overflow: hidden;
  white-space: nowrap;
}

.el-menu-vertical {
  border-right: none;
}

/* 折叠时去除文字换行影响 */
.el-menu--collapse {
  width: 64px;
}

.header {
  background-color: #fff;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: space-between; /* 修改为两端对齐 */
  border-bottom: 1px solid #eee;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  padding: 0 20px; /* 增加内边距 */
}

.header-left {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.collapse-icon {
  font-size: 20px;
  color: #333;
}

.collapse-icon:hover {
  color: #409EFF;
}

.header-right {
  display: flex;
  align-items: center;
}

.main {
  background-color: #f0f2f5;
  padding: 20px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
