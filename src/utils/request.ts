/**
 * 请求工具
 */
import router from "@/router";
import axios from "axios";
import { ElMessage } from "element-plus";

const request = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  timeout: 5000,
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 添加token;
    const userInfo = JSON.parse(localStorage.getItem("user") || "{}");
    if (userInfo.token) {
      config.headers.Authorization = userInfo.token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    response = response.data;
    console.log(response, "响应数据");
    if (response.status === 401) {
      router.push("/login");
      ElMessage.error("登录过期，请重新登录");
      return Promise.reject(new Error("登录过期"));
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  },
);
export default request;
