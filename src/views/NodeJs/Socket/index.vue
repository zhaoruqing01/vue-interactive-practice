<template>
  <div class="chat-container">
    <h1>全体公共聊天室</h1>

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
import { getGroupMsgAPI } from "@/api/group";
import { useUserStore } from "@/store/user";
import { io } from "socket.io-client";
import { nextTick, onMounted, onUnmounted, ref } from "vue";

const userStore = useUserStore();
const socket = io(import.meta.env.VITE_BASE_URL, {
  transports: ["websocket"],
});

interface Message {
  sender: string;
  text: string;
  time: string;
  isSelf: boolean;
}

const messages = ref<Message[]>([
  {
    sender: "系统",
    text: "欢迎进入公共聊天室！",
    time: new Date().toLocaleTimeString(),
    isSelf: false,
  },
]);

const inputMessage = ref("");
const messageListRef = ref<HTMLElement | null>(null);

// ======================================
// 监听公共消息（正确版）
// ======================================
const receivePublicMsg = (msg: any) => {
  const isSelf = msg.userId === userStore.userInfo.userId;

  messages.value.push({
    sender: msg.username,
    text: msg.content,
    time: new Date(msg.sendTime).toLocaleTimeString(),
    isSelf,
  });
  scrollToBottom();
};

onMounted(() => {
  // 监听正确的事件名,表示的是监听该事件名并执行对应操作
  socket.on("receivePublicMsg", receivePublicMsg);
  // 获取聊天记录
  getPublicChatRecord().then(() => {
    scrollToBottom();
  });
});

onUnmounted(() => {
  socket.off("receivePublicMsg", receivePublicMsg);
});

const getPublicChatRecord = async () => {
  const res = await getGroupMsgAPI(0);
  if (res.code === 200) {
    messages.value = res.data.map((item: any) => {
      return {
        sender: item.username,
        text: item.content,
        time: new Date(item.send_time).toLocaleTimeString(),
        isSelf: item.user_id === userStore.userInfo.userId,
      };
    });
  }
};

// ======================================
// 发送公共消息（正确版）
// ======================================
const sendMessage = () => {
  if (!inputMessage.value.trim()) return;

  // 发给后端的正确结构
  const msgData = {
    userId: userStore.userInfo.userId,
    username: userStore.userInfo.username || "匿名用户",
    content: inputMessage.value,
  };

  // ✅ 正确事件名,emit表示发送,on表示监听,to表示发送对象
  socket.emit("sendPublicMsg", msgData);

  inputMessage.value = "";
};

const scrollToBottom = async () => {
  await nextTick();
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
  }
};
</script>

<style scoped>
/* 你的样式完全不用改 */
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
