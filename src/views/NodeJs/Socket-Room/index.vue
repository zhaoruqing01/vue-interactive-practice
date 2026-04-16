<template>
  <div class="socket-room-container">
    <!-- 左侧：群聊列表 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>群聊列表</h2>
        <div class="header-actions">
          <button
            @click="showCreateModal = true"
            class="btn-create"
            title="新建群聊"
          >
            +
          </button>
          <button
            @click="toggleSearch"
            class="btn-search-toggle"
            :class="{ active: isSearchVisible }"
            title="搜索群聊"
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
            @keyup.enter="searchRooms"
            placeholder="输入名称回车搜索..."
            class="search-input"
          />
          <button @click="searchRooms" class="btn-search-exec">Go</button>
        </div>
      </transition>

      <div
        v-if="searchKeyword && searchResults.length > 0"
        class="search-results"
      >
        <div class="result-title">搜索结果</div>
        <div
          v-for="room in searchResults"
          :key="room.group_id"
          class="room-item search-result-item"
          @click="joinSearchedRoom(room)"
        >
          <span class="room-name">{{ room.group_name }}</span>
          <span class="join-tip">点击加入</span>
        </div>
      </div>

      <div v-else class="room-list">
        <!-- 群聊列表 -->
        <div
          v-for="room in rooms"
          :key="room.group_id"
          :class="[
            'room-item',
            { active: currentRoom?.group_id === room.group_id },
          ]"
          @click="switchRoom(room)"
        >
          <span class="room-name">{{ room.group_name }}</span>
          <button
            class="btn-delete"
            @click.stop="deleteRoom(room.group_id)"
            title="删除群聊"
          >
            ×
          </button>
        </div>
        <div v-if="rooms.length === 0" class="empty-tip">暂无群聊，请创建</div>
      </div>
    </div>

    <!-- 右侧：聊天区域 -->
    <div class="chat-area" v-if="currentRoom">
      <div class="chat-header">
        <h3>{{ currentRoom.group_name }}</h3>
        <span class="room-id">ID: {{ currentRoom.group_id }}</span>
      </div>

      <div class="message-list" ref="messageListRef">
        <div
          v-for="(msg, index) in currentMessages"
          :key="index"
          :class="['message-item', msg.isSelf ? 'self' : 'other']"
        >
          <div class="message-content">
            <span class="sender">
              {{ msg.sender }}
              <span v-if="msg.isOwner" class="owner-badge">群主</span>
            </span>
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
      <p>请选择或创建一个群聊开始聊天</p>
    </div>

    <div v-if="showCreateModal" class="modal-overlay">
      <div class="modal">
        <h3>创建新群聊</h3>
        <input
          v-model="newRoomName"
          placeholder="输入群聊名称"
          @keyup.enter="createRoom"
        />
        <div class="modal-actions">
          <button @click="showCreateModal = false">取消</button>
          <button @click="createRoom" class="btn-confirm">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  createGroupAPI,
  deleteGroupAPI,
  exitGroupAPI,
  getGroupListAPI,
  getGroupMsgAPI,
  getJoinedGroupListAPI,
  joinGroupAPI,
} from "@/api/group";
import { useUserStore } from "@/store/user";
import dayjs from "dayjs";
import { ElMessage, ElMessageBox } from "element-plus";
import { io, Socket } from "socket.io-client";
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";

interface Room {
  create_time: string;
  group_id: number;
  group_name: string;
  is_deleted: number;
  owner_id: number;
}

interface Message {
  sender: string;
  text: string;
  time: string;
  isSelf: boolean;
  isOwner?: boolean; // 新增：是否是群主发送的消息
}

const userStore = useUserStore();
const socket = ref<Socket | null>(null);

const rooms = ref<Room[]>([]);
const currentRoom = ref<Room | null>(null);
const showCreateModal = ref(false);
const newRoomName = ref("");

const searchKeyword = ref("");
const searchResults = ref<Room[]>([]);
const isSearchVisible = ref(false);

const messagesMap = ref<Record<string, Message[]>>({});
const inputMessage = ref("");
const messageListRef = ref<HTMLElement | null>(null);
const currentTime = ref(dayjs().format("YYYY-MM-DD HH:mm:ss"));

const currentMessages = computed(() => {
  if (!currentRoom.value) return [];
  return messagesMap.value[currentRoom.value.group_id] || [];
});

const getJoinedGroupList = async () => {
  try {
    const res = await getJoinedGroupListAPI();
    if (res.code === 200) {
      rooms.value = res.data;
    }
  } catch (error) {
    ElMessage.error(error.message || "获取已加入群聊失败");
  }
};

onMounted(() => {
  getJoinedGroupList();

  socket.value = io(import.meta.env.VITE_BASE_URL, {
    transports: ["websocket"],
  });

  socket.value.on("connect", () => {
    console.log("✅ Socket 连接成功");
  });

  // 消息完全有socket控制
  socket.value.on("receiveGroupMsg", (msg) => {
    const groupId = msg.groupId;
    const isSelf = msg.userId === userStore.userInfo.userId;

    const message = {
      sender: msg.username,
      text: msg.content,
      time: new Date(msg.sendTime).toLocaleTimeString(),
      isSelf,
      isOwner: msg.userId === currentRoom.value?.owner_id, // 新增：标记是否为群主
    };

    if (!messagesMap.value[groupId]) {
      messagesMap.value[groupId] = [];
    }
    messagesMap.value[groupId].push(message);

    if (currentRoom.value?.group_id === groupId) {
      scrollToBottom();
    }
  });
});

onUnmounted(() => {
  socket.value?.disconnect();
});

const searchRooms = () => {
  if (!searchKeyword.value.trim()) return;
  getGroupListAPI(searchKeyword.value).then((res) => {
    searchResults.value = res.data;
  });
};

const joinSearchedRoom = (room: Room) => {
  joinGroupAPI(room.group_id)
    .then(() => {
      ElMessage.success("加入群聊成功");
      getJoinedGroupList();
      switchRoom(room);
    })
    .catch(() => {
      ElMessage.error("加入群聊失败");
    });

  searchKeyword.value = "";
  searchResults.value = [];
};

const switchRoom = async (room: Room) => {
  if (currentRoom.value?.group_id === room.group_id) return;

  if (currentRoom.value) {
    socket.value?.emit("quitGroup", currentRoom.value.group_id);
  }

  currentRoom.value = room;
  socket.value?.emit("joinGroup", room.group_id);

  // ======================
  // 在这里加载历史聊天记录
  // ======================
  const historyRes = await getGroupMsgAPI(room.group_id);
  if (historyRes && historyRes.code === 200) {
    messagesMap.value[room.group_id] = historyRes.data.map((item) => ({
      sender: item.username,
      text: item.content,
      time: new Date(item.send_time).toLocaleTimeString(),
      isSelf: item.user_id === userStore.userInfo.userId,
      isOwner: item.user_id === room.owner_id, // 新增：标记是否为群主
    }));
  } else {
    messagesMap.value[room.group_id] = [];
  }

  nextTick(() => {
    scrollToBottom();
  });
};

const sendMessage = () => {
  if (!inputMessage.value.trim() || !currentRoom.value || !socket.value) return;

  const msgData = {
    groupId: currentRoom.value.group_id,
    userId: userStore.userInfo.userId,
    username: userStore.userInfo.username || "匿名用户",
    content: inputMessage.value,
  };

  socket.value.emit("sendGroupMsg", msgData);

  if (!messagesMap.value[currentRoom.value.group_id]) {
    messagesMap.value[currentRoom.value.group_id] = [];
  }

  inputMessage.value = "";
  scrollToBottom();
};

const createRoom = async () => {
  if (!newRoomName.value.trim()) return;

  try {
    const res = await createGroupAPI({
      group_name: newRoomName.value,
      owner_id: userStore.userInfo.userId,
      is_deleted: false,
      create_time: currentTime.value,
    });

    if (res.code === 200) {
      newRoomName.value = "";
      showCreateModal.value = false;
      getJoinedGroupList();
      ElMessage.success("创建房间成功");
    }
  } catch (err: any) {
    ElMessage.error(err.msg || "创建失败");
  }
};

const deleteRoom = (roomId: number) => {
  // 查找当前房间信息以获取 owner_id
  const room = rooms.value.find((r) => r.group_id === roomId);
  if (!room) return;

  const isOwner = room.owner_id === userStore.userInfo.userId;
  const actionText = isOwner ? "删除" : "退出";
  const tipText = isOwner
    ? "确定要删除这个群聊吗？此操作不可恢复。"
    : "确定要退出这个群聊吗？";

  ElMessageBox.confirm(tipText, `${actionText}提示`, {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  })
    .then(() => {
      if (isOwner) {
        // 群主执行删除
        return deleteGroupAPI(roomId);
      } else {
        // 非群主执行退出
        // 注意：请确保 quitGroupAPI 已在上方 import 且真实存在
        // 如果没有单独退出接口，可能需要调用其他特定接口
        return exitGroupAPI(roomId);
      }
    })
    .then(() => {
      ElMessage.success(`${actionText}成功`);
      getJoinedGroupList();
      if (currentRoom.value?.group_id === roomId) {
        currentRoom.value = null;
      }
    })
    .catch((err) => {
      if (err !== "cancel") {
        // 忽略用户取消的情况
        ElMessage.error(err.message || `${actionText}失败`);
      }
    });
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

const searchInputRef = ref<HTMLInputElement | null>(null);
</script>

<style scoped>
/* 你的样式不变 */
.socket-room-container {
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

.header-actions {
  display: flex;
  gap: 5px;
}

.btn-create {
  background-color: #409eff;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-create:hover {
  background-color: #66b1ff;
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

.join-tip {
  font-size: 10px;
  color: #409eff;
}

.room-list {
  flex: 1;
  overflow-y: auto;
}

.room-item {
  padding: 12px 15px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
  border-bottom: 1px solid #ebeef5;
}

.room-item:hover {
  background-color: #e6f7ff;
}

.room-item.active {
  background-color: #bae7ff;
  border-left: 4px solid #409eff;
}

.room-name {
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-delete {
  background: transparent;
  border: none;
  color: #999;
  font-size: 18px;
  cursor: pointer;
  padding: 0 5px;
  line-height: 1;
}

.btn-delete:hover {
  color: #f56c6c;
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

.room-id {
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

.owner-badge {
  background-color: #f56c6c;
  color: white;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 2px;
  transform: scale(0.9);
  display: inline-block;
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

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
}

.modal input {
  width: 100%;
  padding: 8px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-actions button {
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #ddd;
  background: #fff;
}

.modal-actions .btn-confirm {
  background-color: #409eff;
  color: white;
  border: none;
}

.modal-actions .btn-confirm:hover {
  background-color: #66b1ff;
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
