import request from "@/utils/request";

/**
 * 获取BFF列表
 * @param params
 * @returns
 */
export const getBFFListAPI = (params?: any) => {
  return request.get("/api/bff", { params });
};
