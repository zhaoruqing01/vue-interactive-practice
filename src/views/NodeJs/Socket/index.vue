<template>
  <div class="chat-container">
    <h1>聊天室</h1>

    <!-- 消息列表区域 -->
    <div class="message-list" ref="messageListRef">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message-item', msg.isSelf ? 'self' : 'other']"
      >
        <div class="message-content">
          <span class="sender">{{ msg.sender }}</span>
          <p class="text">{{ msg.text }}</p>
          <span class="time">{{ msg.time }}</span>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <input
        v-model="inputMessage"
        @keyup.enter="sendMessage"
        placeholder="请输入消息..."
        type="text"
      />
      <button @click="sendMessage">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
// 引入Socket客户端
import { useUserStore } from "@/store/user";
import { io } from "socket.io-client";

// 实例化用户模块
const userStore = useUserStore();
// 保存自己的id,用于判断是否是自己发送的消息
const selfId = ref();

// 消息类型定义（完全保留）
interface Message {
  sender: string;
  text: string;
  time: string;
  isSelf: boolean;
}

// 响应式数据（完全保留）
const messages = ref<Message[]>([
  {
    sender: "系统",
    text: "欢迎进入聊天室！",
    time: new Date().toLocaleTimeString(),
    isSelf: false,
  },
]);
const inputMessage = ref("");
const messageListRef = ref<HTMLElement | null>(null);

// ============== 核心修改：创建Socket连接 ==============
const socket = io("http://127.0.0.1:3007", {
  transports: ["websocket"], // 强制WebSocket，更稳定
});

socket.on("connect", () => {
  selfId.value = socket.id; // 拿到自己的ID
  console.log("我的ID：", socket.id);
});

// 监听服务端推送的实时消息
const receiveMessage = (msg: Omit<Message, "isSelf">) => {
  messages.value.push({
    ...msg,
    isSelf: msg.userId === selfId.value, // 别人发的消息，显示在左侧
  });
  scrollToBottom();
};

// 组件挂载：监听Socket消息
onMounted(() => {
  // 监听服务端广播的聊天消息
  socket.on("chat message", receiveMessage);

  // 连接成功提示
  socket.on("connect", () => {
    console.log("✅ 连接聊天室成功");
  });
});

// 组件销毁：移除监听（防止内存泄漏）
onUnmounted(() => {
  socket.off("chat message", receiveMessage);
});

// ============== 发送消息（替换模拟逻辑，改为真实Socket发送） ==============
const sendMessage = () => {
  if (!inputMessage.value.trim()) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString();

  // 构建消息对象
  const msgData = {
    sender: userStore.userInfo.username || "匿名用户",
    text: inputMessage.value,
    time: timeStr,
  };

  // 1. 自己的消息直接渲染到页面
  // messages.value.push({
  //   ...msgData,
  //   isSelf: true,
  // });

  // 2. 通过Socket发送给后端
  socket.emit("chat message", msgData);

  // 3. 清空输入框+滚动到底部
  inputMessage.value = "";
  scrollToBottom();
};

// 滚动到底部辅助函数（完全保留）
const scrollToBottom = async () => {
  await nextTick();
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
  }
};
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  width: calc(100vw - 250px);
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
  font-family: Arial, sans-serif;
}

h1 {
  text-align: center;
  padding: 10px;
  margin: 0;
  background-color: #f5f5f5;
  border-bottom: 1px solid #eee;
}

.message-list {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  background-color: #fafafa;
}

.message-item {
  margin-bottom: 10px;
  display: flex;
}

.message-item.self {
  justify-content: flex-end;
}

.message-item.other {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 8px 12px;
  border-radius: 8px;
  position: relative;
  word-wrap: break-word;
}

.message-item.self .message-content {
  background-color: #95ec69;
  color: #000;
}

.message-item.other .message-content {
  background-color: #fff;
  border: 1px solid #ddd;
  color: #333;
}

.sender {
  font-size: 12px;
  color: #888;
  display: block;
  margin-bottom: 2px;
}

.text {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
}

.time {
  font-size: 10px;
  color: #aaa;
  display: block;
  text-align: right;
  margin-top: 4px;
}

.input-area {
  display: flex;
  padding: 10px;
  background-color: #fff;
  border-top: 1px solid #eee;
}

.input-area input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-right: 10px;
  outline: none;
}

.input-area input:focus {
  border-color: #409eff;
}

.input-area button {
  padding: 8px 16px;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.input-area button:hover {
  background-color: #66b1ff;
}
</style>
