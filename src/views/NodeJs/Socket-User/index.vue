<template>
  <div class="socket-user-container">
    <!-- 左侧：用户列表 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>在线用户</h2>
        <div class="header-actions">
          <button
            @click="toggleSearch"
            class="btn-search-toggle"
            :class="{ active: isSearchVisible }"
            title="搜索用户"
          >
            🔍
          </button>
        </div>
      </div>

      <transition name="slide-down">
        <div v-if="isSearchVisible" class="search-area">
          <input
            ref="searchInputRef"
            v-model="searchKeyword"
            @keyup.enter="searchUsers"
            placeholder="输入用户名回车搜索..."
            class="search-input"
          />
          <button @click="searchUsers" class="btn-search-exec">Go</button>
        </div>
      </transition>

      <!-- 好友请求列表 -->
      <div v-if="friendRequests.length > 0" class="friend-requests-area">
        <div class="section-title" @click="toggleRequests">
          <span>好友申请 ({{ friendRequests.length }})</span>
          <span class="expand-icon">{{ isRequestsExpanded ? "▲" : "▼" }}</span>
        </div>

        <div v-show="isRequestsExpanded" class="request-list-content">
          <div
            v-for="req in friendRequests"
            :key="req.fromUserId"
            class="request-item"
          >
            <div class="request-info">
              <span class="requester-name">{{ req.fromUsername }}</span>
              <span class="request-msg">申请加为好友</span>
            </div>
            <div class="request-actions">
              <button @click="acceptFriendRequest(req)" class="btn-accept">
                同意
              </button>
              <button @click="rejectFriendRequest(req)" class="btn-reject">
                拒绝
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="searchKeyword && searchResults.length > 0"
        class="search-results"
      >
        <div class="result-title">搜索结果</div>
        <div
          v-for="user in searchResults"
          :key="user.id"
          class="user-item search-result-item"
        >
          <span class="user-name">{{ user.username }}</span>
          <span class="chat-tip" @click="addFriend(user)">添加好友</span>
        </div>
      </div>

      <div v-else class="user-list">
        <div
          v-for="user in users"
          :key="user.fromUserId"
          :class="[
            'user-item',
            { active: currentUser?.fromUserId === user.fromUserId },
          ]"
          @click="switchUser(user)"
        >
          <span class="user-name">{{ user.fromUsername }}</span>
          <span v-if="user.isOnline" class="status-dot online"></span>
          <span v-else class="status-dot offline"></span>
        </div>
        <div v-if="users.length === 0" class="empty-tip">暂无用户列表</div>
      </div>
    </div>

    <!-- 右侧：聊天区域 -->
    <div class="chat-area" v-if="currentUser">
      <div class="chat-header">
        <h3>{{ currentUser.fromUsername }}</h3>
        <span class="user-id">ID: {{ currentUser.id }}</span>
      </div>

      <div class="message-list" ref="messageListRef">
        <div
          v-for="(msg, index) in currentMessages"
          :key="index"
          :class="['message-item', msg.isSelf ? 'self' : 'other']"
        >
          <div class="message-content">
            <span class="sender">{{ msg.sender }}</span>
            <p class="text">{{ msg.text }}</p>
            <span class="time">{{ msg.time }}</span>
          </div>
        </div>
        <div v-if="currentMessages.length === 0" class="empty-chat">
          开始新的对话吧~
        </div>
      </div>

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

    <div class="chat-area empty-state" v-else>
      <p>请选择一个用户开始私聊</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  getAllUsersAPI,
  getApplyHistoryAPI,
  getFriendChatHistoryAPI,
  getFriendListAPI,
} from "@/api/userFriends";
import { useUserStore } from "@/store/user";
import dayjs from "dayjs";
import { ElMessage } from "element-plus";
import { io, Socket } from "socket.io-client";
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";

interface User {
  id: number;
  fromUserId: number;
  fromUsername: string;
  apply_msg: string;
  create_time: string;
  status: number;
  isOnline: boolean;
}

interface FriendRequest {
  fromUserId: number;
  fromUsername: string;
  create_time: string;
}

interface Message {
  sender: string;
  text: string;
  time: string;
  isSelf: boolean;
  targetUserId?: number;
}

const userStore = useUserStore();
const socket = ref<Socket | null>(null);

const users = ref<User[]>([]);
const currentUser = ref<User | null>(null);
const friendRequests = ref<FriendRequest[]>([]);

const searchKeyword = ref("");
const searchResults = ref<User[]>([]);
const isSearchVisible = ref(false);
const isRequestsExpanded = ref(false); // 默认折叠

const messagesMap = ref<Record<number, Message[]>>({});
const inputMessage = ref("");
const messageListRef = ref<HTMLElement | null>(null);

const currentMessages = computed(() => {
  if (!currentUser.value) return [];
  return messagesMap.value[currentUser.value.fromUserId] || [];
});

// 获取好友聊天记录
const getFriendChatHistory = async (friendUserId: number) => {
  try {
    const res = await getFriendChatHistoryAPI(
      userStore.userInfo.userId,
      friendUserId,
    );
    if (res.code === 200) {
      // 修复：将后端返回的历史消息格式转换为前端 Message 格式
      const historyMessages = (res.data || []).map((msg: any) => ({
        sender: msg.username || msg.fromUsername || "未知用户",
        text: msg.content,
        time: dayjs(msg.sendTime).format("YYYY-MM-DD HH:mm:ss"),
        isSelf: msg.fromUserId === userStore.userInfo.userId,
        targetUserId:
          msg.fromUserId === userStore.userInfo.userId
            ? msg.toUserId
            : msg.fromUserId,
      }));
      messagesMap.value[friendUserId] = historyMessages;
    }
  } catch (error: any) {
    ElMessage.error(error.message || "获取好友聊天记录失败");
  }
};
// 获取好友申请历史 ✅ 修复：userId字段
const getApplyHistory = async () => {
  try {
    const res = await getApplyHistoryAPI(userStore.userInfo.userId); // 修复这里
    if (res.code === 200) {
      friendRequests.value = res.data;
    }
  } catch (error: any) {
    ElMessage.error(error.message || "获取好友申请失败");
  }
};

// 获取用户好友列表
const getFriendList = async () => {
  try {
    const res = await getFriendListAPI(userStore.userInfo.userId);
    if (res.code === 200) {
      users.value = res.data;
    }
  } catch (error: any) {
    ElMessage.error(error.message || "获取好友列表失败");
  }
};

// 搜索用户
const searchUsers = async () => {
  try {
    const res = await getAllUsersAPI(searchKeyword.value);
    if (res.code === 200) {
      searchResults.value = res.data;
    }
  } catch (error: any) {
    ElMessage.error(error.message || "搜索失败");
  }
};

// 添加好友 ✅ 核心修复：userId传参错误
const addFriend = (user: User) => {
  socket.value?.emit("friend_apply", {
    friendId: user.id,
    userId: userStore.userInfo.userId, // 🔥 修复：从 id 改为 userId
    username: userStore.userInfo.username,
    applyMsg: "申请加为好友", // 补全参数，避免空值
  });
};

onMounted(() => {
  getApplyHistory();
  getFriendList();

  socket.value = io(import.meta.env.VITE_BASE_URL, {
    transports: ["websocket"],
  });

  socket.value.on("connect", () => {
    console.log("✅ Socket 连接成功");
    // ✅ 统一事件名
    socket.value?.emit("user:online", {
      userId: userStore.userInfo.userId,
      username: userStore.userInfo.username,
    });
  });

  // 监听新好友申请
  socket.value.on("friend:apply:receive", (data) => {
    const exists = friendRequests.value.some(
      (r) => r.fromUserId === data.fromUserId,
    );
    if (!exists) {
      friendRequests.value.unshift({
        fromUserId: data.fromUserId,
        fromUsername: data.fromUsername,
        create_time: data.createTime,
      });
    }
  });

  // 监听同意通知
  socket.value.on("friend:accept:success", (data) => {
    ElMessage.success(data.msg);
    getApplyHistory();
  });

  // 监听拒绝通知
  socket.value.on("friend:refuse:success", (data) => {
    ElMessage.warning(data.msg);
    getApplyHistory();
  });

  // 监听申请结果
  socket.value.on("addFriendSuccess", (data) => {
    ElMessage.success(data.msg);
    getApplyHistory();
  });

  socket.value.on("addFriendError", (data) => {
    ElMessage.error(data.msg);
  });

  // 监听好友在线状态变化
  socket.value.on("friend:status:change", (data) => {
    console.log(data, "在线data");

    const friend = users.value.find((u) => u.fromUserId === data.targetUserId);
    if (friend) {
      friend.isOnline = data.isOnline;
      if (data.isOnline) {
        ElMessage.success(`${friend.fromUsername}上线了`);
      } else {
        ElMessage.info(`${friend.fromUsername}下线了`);
      }
    }
  });

  // 私聊消息
  socket.value.on("receivePrivateMsg", (msg) => {
    // 1. 先拿到自己的 ID
    const myId = userStore.userInfo.userId;

    // 2. 判断这条消息是不是【我自己发的】
    const isSelf = msg.fromUserId === myId;

    // 3. 计算：当前消息属于哪个聊天对象（非常关键！）
    const chatPartnerId = isSelf ? msg.toUserId : msg.fromUserId;

    // 4. 构造消息（字段统一）
    const message = {
      sender: msg.fromUsername,
      text: msg.content,
      time: dayjs(msg.sendTime).format("YYYY-MM-DD HH:mm:ss"),
      isSelf: isSelf,
      targetUserId: chatPartnerId,
    };

    // 5. 存入消息列表
    if (!messagesMap.value[chatPartnerId]) {
      messagesMap.value[chatPartnerId] = [];
    }
    messagesMap.value[chatPartnerId].push(message);

    // 6. 如果正在聊天 → 滚动到底部
    // 注意：currentUser.value.fromUserId 必须是对方ID！！！
    if (currentUser.value?.fromUserId === chatPartnerId) {
      scrollToBottom();
    }
    // 7. 【只有不是自己发的，并且不在当前聊天页，才提示】
    else if (!isSelf) {
      ElMessage.info(`收到 ${msg.fromUsername} 的消息`);
    }
  });

  socket.value.on("systemMsg", (msg) => ElMessage.success(msg.content));
});

onUnmounted(() => {
  socket.value?.disconnect();
});

// 同意好友 ✅ 修复：userId字段
const acceptFriendRequest = (req: FriendRequest) => {
  socket.value?.emit("friend:accept", {
    userId: userStore.userInfo.userId, // 修复这里
    applyUserId: req.fromUserId,
    username: userStore.userInfo.username,
    applyUserName: req.fromUsername,
  });
  friendRequests.value = friendRequests.value.filter(
    (r) => r.fromUserId !== req.fromUserId,
  );
  getFriendList();
};

// 拒绝好友 ✅ 修复：userId字段
const rejectFriendRequest = (req: FriendRequest) => {
  socket.value?.emit("friend:refuse", {
    userId: userStore.userInfo.userId, // 修复这里
    applyUserId: req.fromUserId,
    username: userStore.userInfo.username,
    applyUserName: req.fromUsername,
  });
  friendRequests.value = friendRequests.value.filter(
    (r) => r.fromUserId !== req.fromUserId,
  );
};

const switchUser = (user: User) => {
  if (currentUser.value?.fromUserId === user.fromUserId) return;
  currentUser.value = user;
  getFriendChatHistory(user.fromUserId);
  if (!messagesMap.value[user.fromUserId])
    messagesMap.value[user.fromUserId] = [];
  nextTick(scrollToBottom);
};

const sendMessage = () => {
  if (!inputMessage.value.trim() || !currentUser.value || !socket.value) return;
  const msgData = {
    toUserId: currentUser.value.fromUserId,
    fromUserId: userStore.userInfo.userId, // 修复这里
    fromUsername: userStore.userInfo.username,
    content: inputMessage.value,
    sendTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
  };
  socket.value.emit("sendPrivateMsg", msgData);
  inputMessage.value = "";
};

const scrollToBottom = async () => {
  await nextTick();
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
  }
};

const toggleSearch = () => {
  isSearchVisible.value = !isSearchVisible.value;
};

const toggleRequests = () => {
  isRequestsExpanded.value = !isRequestsExpanded.value;
};

const searchInputRef = ref<HTMLInputElement | null>(null);
</script>

<style scoped>
/* 复用并微调 Socket-Room 的样式 */
.socket-user-container {
  display: flex;
  height: calc(100vh - 120px);
  width: calc(100vw - 250px);
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
  font-family: Arial, sans-serif;
  background-color: #fff;
}

.sidebar {
  width: 250px;
  background-color: #f0f2f5;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 15px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

/* 新增：好友请求区域样式 */
.friend-requests-area {
  border-bottom: 1px solid #e8e8e8;
  background-color: #fffbe6; /* 淡黄色背景提示有待处理事项 */
}

.section-title {
  padding: 8px 15px;
  font-size: 12px;
  font-weight: bold;
  color: #d48806;
  background-color: #fff1b8;
  border-bottom: 1px solid #ffe58f;
  cursor: pointer; /* 提示可点击 */
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
}

.section-title:hover {
  background-color: #ffe58f;
}

.expand-icon {
  font-size: 10px;
  margin-left: 8px;
}

/* 动画容器 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 200px; /* 根据内容预估最大高度 */
  opacity: 1;
}

.request-list-content {
  max-height: 200px;
  overflow-y: auto;
}

.request-item {
  padding: 10px 15px;
  border-bottom: 1px solid #ffe58f;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.request-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.requester-name {
  font-weight: bold;
  color: #333;
}

.request-msg {
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.request-actions {
  display: flex;
  gap: 5px;
}

.btn-accept,
.btn-reject {
  padding: 2px 6px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  font-size: 10px;
}

.btn-accept {
  background-color: #52c41a;
  color: white;
}

.btn-accept:hover {
  background-color: #73d13d;
}

.btn-reject {
  background-color: #f5f5f5;
  color: #666;
  border: 1px solid #d9d9d9;
}

.btn-reject:hover {
  color: #ff4d4f;
  border-color: #ff4d4f;
}

.header-actions {
  display: flex;
  gap: 5px;
}

.btn-search-toggle {
  background-color: #f0f2f5;
  color: #999;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-search-toggle:hover {
  background-color: #e8e8e8;
}

.btn-search-toggle.active {
  background-color: #409eff;
  color: white;
}

.search-area {
  padding: 10px 15px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  gap: 5px;
  background-color: #fff;
}

.search-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.search-input:focus {
  border-color: #409eff;
}

.btn-search-exec {
  padding: 6px 10px;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-search-exec:hover {
  background-color: #66b1ff;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  background-color: #fff;
}

.result-title {
  padding: 8px 15px;
  font-size: 12px;
  color: #999;
  background-color: #fafafa;
  border-bottom: 1px solid #eee;
}

.search-result-item {
  cursor: pointer;
  background-color: #f9f9f9;
}

.search-result-item:hover {
  background-color: #e6f7ff;
}

.chat-tip {
  font-size: 10px;
  color: #409eff;
}

.user-list {
  flex: 1;
  overflow-y: auto;
}

.user-item {
  padding: 12px 15px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
  border-bottom: 1px solid #ebeef5;
}

.user-item:hover {
  background-color: #e6f7ff;
}

.user-item.active {
  background-color: #bae7ff;
  border-left: 4px solid #409eff;
}

.user-name {
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.online {
  background-color: #67c23a;
}

.status-dot.offline {
  background-color: #909399;
}

.empty-tip {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 12px;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fafafa;
}

.chat-header {
  padding: 10px 20px;
  background-color: #fff;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
}

.user-id {
  font-size: 12px;
  color: #999;
}

.message-list {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.empty-chat {
  text-align: center;
  color: #ccc;
  margin-top: 50px;
}

.message-item {
  display: flex;
  width: 100%;
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
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.message-item.self .message-content {
  background-color: #95ec69;
  color: #000;
  border-top-right-radius: 2px;
}

.message-item.other .message-content {
  background-color: #fff;
  border: 1px solid #ddd;
  color: #333;
  border-top-left-radius: 2px;
}

.sender {
  font-size: 12px;
  color: #888;
  display: block;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
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
  padding: 15px;
  background-color: #fff;
  border-top: 1px solid #eee;
}

.input-area input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-right: 10px;
  outline: none;
  transition: border-color 0.2s;
}

.input-area input:focus {
  border-color: #409eff;
}

.input-area button {
  padding: 0 20px;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.input-area button:hover {
  background-color: #66b1ff;
}

.empty-state {
  justify-content: center;
  align-items: center;
  color: #999;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
