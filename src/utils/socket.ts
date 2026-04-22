import { io, Socket } from "socket.io-client";

const URL = import.meta.env.VITE_BASE_URL;

// 创建 Socket 实例的工具函数
export const createSocket = (): Socket => {
  return io(URL, {
    transports: ["websocket"],
    secure: window.location.protocol === "https:",
    rejectUnauthorized: false,
  });
};

// 单例模式，如果整个应用只需要一个连接
let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = createSocket();
    
    socket.on("connect", () => {
      console.log("✅ Socket 连接成功:", socket?.id);
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket 连接失败:", error);
    });
  }
  return socket;
};

export default getSocket;
