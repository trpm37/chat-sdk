<template>
  <div class="chat-page" v-loading="loading" element-loading-background="rgba(0, 0, 0, 0.2)">
    <div class="main">
      <!-- 渲染区 -->
      <div class="webgl" id="webgl">
        <video class="videoScene"></video>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const loading=ref(false);
onMounted(async () => {
  console.log(loading.value,111);
});
</script>

<style scoped lang="scss">
@import "./index";
</style>
