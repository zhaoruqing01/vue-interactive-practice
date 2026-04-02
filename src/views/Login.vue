<template>
  <div class="login-container">
    <div class="login-box">
      <h2 class="login-title">用户登录</h2>
      <el-form
        :model="loginForm"
        :rules="rules"
        ref="loginFormRef"
        class="login-form"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
            prefix-icon="User"
            size="large"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            prefix-icon="Lock"
            size="large"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            @click="handleLogin"
            :loading="loading"
            class="login-button"
            size="large"
          >
            登录
          </el-button>
          <el-button
            type="primary"
            class="login-button"
            plain
            @click="handleRegister"
            size="large"
            style="margin-left: 0px"
          >
            注册
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getUserInfoAPI, loginAPI, registerAPI } from "@/api/user";
import { useUserStore } from "@/store/user";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";

// 实例化用户模块
const userStore = useUserStore();

const router = useRouter();
const loginFormRef = ref<FormInstance>();
const loading = ref(false);

const loginForm = reactive({
  username: "",
  password: "",
});

const rules = reactive<FormRules>({
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    {
      min: 3,
      max: 20,
      message: "用户名长度在 3 到 20 个字符",
      trigger: "blur",
    },
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, max: 20, message: "密码长度在 6 到 20 个字符", trigger: "blur" },
  ],
});

// 登录
const handleLogin = async () => {
  if (!loginFormRef.value) return;

  await loginFormRef.value.validate((valid) => {
    if (valid) {
      loading.value = true;
      // 模拟登录请求
      loginAPI(loginForm)
        .then((res) => {
          if (res.status === 0) {
            // 存储token
            userStore.setToken(res.token);
            getUserInfoAPI().then((res) => {
              userStore.setUserInfo(res.data);
            });
            ElMessage.success("登录成功！");
            router.push("/");
          } else {
            ElMessage.error(res.msg || "登录失败");
          }
        })
        .finally(() => {
          loading.value = false;
        });
    } else {
      ElMessage.error("请填写完整的登录信息");
      return false;
    }
  });
};

// 注册
const handleRegister = async () => {
  if (!loginFormRef.value) return;

  await loginFormRef.value.validate((valid) => {
    if (valid) {
      loading.value = true;
      // 模拟注册请求
      registerAPI(loginForm)
        .then((res) => {
          if (res.status === 0) {
            ElMessage.success("注册成功！");
            router.push("/login");
          } else {
            ElMessage.error(res.msg || "注册失败");
          }
        })
        .finally(() => {
          loading.value = false;
        });
    } else {
      ElMessage.error("请填写完整的注册信息");
      return false;
    }
  });
};
</script>

<style lang="scss" scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #333;
}

.login-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.login-title {
  text-align: center;
  margin: 0 0 30px 0;
  font-size: 28px;
  color: #333;
  font-weight: 600;
}

.login-form {
  .el-form-item {
    margin-bottom: 20px;
  }

  .login-button {
    width: 100%;
    margin-top: 10px;
  }
}

@media (max-width: 768px) {
  .login-box {
    width: 90%;
    padding: 30px 20px;
  }
}
</style>
