/**
 * 请求工具
 */
import axios from "axios";

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
    return response.data;
  },
  (error) => {
    return Promise.reject(error);
  },
);
export default request;
