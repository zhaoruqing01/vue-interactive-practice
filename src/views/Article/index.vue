<template>
  <div class="article-list">
    <h1>文章列表</h1>

    <!-- 查询表单 -->
    <div class="search-form">
      <el-input
        v-model="searchForm.title"
        placeholder="请输入文章标题"
        style="width: 300px"
        clearable
      >
        <template #append>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </template>
      </el-input>
    </div>

    <div class="table-container">
      <!-- 文章表格 -->
      <el-table
        :data="articleList"
        style="width: 100%; height: calc(100vh - 300px)"
        border
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="文章标题" />
        <el-table-column prop="author" label="作者" width="120" />
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag
              :type="scope.row.status === 'published' ? 'success' : 'info'"
            >
              {{ scope.row.status === "published" ? "已发布" : "草稿" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button
              size="small"
              type="primary"
              @click="handleEdit(scope.row)"
              >编辑</el-button
            >
            <el-button
              size="small"
              type="danger"
              @click="handleDelete(scope.row.id)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页组件 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, prev, pager, next, sizes, jumper"
          :total="pagination.total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, reactive, ref } from "vue";

// 搜索表单
const searchForm = reactive({
  title: "",
});

// 分页配置
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0,
});

// 文章列表数据
const articleList = ref([
  {
    id: 1,
    title: "Vue 3 入门指南",
    author: "张三",
    createTime: "2026-03-01 10:00:00",
    status: "published",
  },
  {
    id: 2,
    title: "TypeScript 进阶技巧",
    author: "李四",
    createTime: "2026-03-02 14:30:00",
    status: "published",
  },
  {
    id: 3,
    title: "Element Plus 组件库使用",
    author: "王五",
    createTime: "2026-03-03 09:15:00",
    status: "draft",
  },
  {
    id: 4,
    title: "Vue Router 4 新特性",
    author: "赵六",
    createTime: "2026-03-04 16:45:00",
    status: "published",
  },
  {
    id: 5,
    title: "Pinia 状态管理最佳实践",
    author: "孙七",
    createTime: "2026-03-05 11:20:00",
    status: "draft",
  },
]);

// 初始化时设置总数
onMounted(() => {
  pagination.total = articleList.value.length;
});

// 处理搜索
const handleSearch = () => {
  // 这里可以添加实际的搜索逻辑
  ElMessage.success("搜索功能已触发");
  // 模拟搜索结果
  console.log("搜索关键词:", searchForm.title);
};

// 处理编辑
const handleEdit = (row: any) => {
  ElMessage.info(`编辑文章: ${row.title}`);
  // 这里可以添加实际的编辑逻辑
};

// 处理删除
const handleDelete = (id: number) => {
  // 这里可以添加实际的删除逻辑
  ElMessage.success(`删除文章 ID: ${id}`);
};

// 处理分页大小变化
const handleSizeChange = (size: number) => {
  pagination.pageSize = size;
  // 这里可以添加实际的分页逻辑
};

// 处理当前页码变化
const handleCurrentChange = (current: number) => {
  pagination.currentPage = current;
  // 这里可以添加实际的分页逻辑
};
</script>

<style scoped>
.article-list {
  padding: 20px;
}

.search-form {
  margin-bottom: 20px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
