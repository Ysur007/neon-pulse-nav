<template>
  <div class="customize-drawer" :class="{ open }" :aria-hidden="!open">
    <button class="drawer-backdrop" type="button" aria-label="关闭个性化面板" @click="$emit('close')"></button>

    <aside class="drawer-panel glass-panel">
      <div class="drawer-head">
        <div>
          <p class="kicker">PERSONALIZE</p>
          <h3>定制你的工作台</h3>
        </div>
        <button class="ghost-button ghost-button-square" type="button" @click="$emit('close')">X</button>
      </div>

      <form class="drawer-form" @submit.prevent="$emit('save')">
        <section class="drawer-section">
          <div class="drawer-section-head">
            <div>
              <p class="kicker">PROFILE</p>
              <h4>个人身份和今日主线</h4>
            </div>
          </div>

          <label class="form-field">
            <span>称呼</span>
            <input v-model.trim="draftProfile.alias" type="text" maxlength="24" />
          </label>
          <label class="form-field">
            <span>副标题</span>
            <input v-model.trim="draftProfile.title" type="text" maxlength="48" />
          </label>
          <label class="form-field">
            <span>简介</span>
            <textarea v-model.trim="draftProfile.intro" rows="4" maxlength="160"></textarea>
          </label>
          <label class="form-field">
            <span>状态</span>
            <input v-model.trim="draftProfile.status" type="text" maxlength="36" />
          </label>
          <label class="form-field">
            <span>位置</span>
            <input v-model.trim="draftProfile.location" type="text" maxlength="36" />
          </label>
          <label class="form-field">
            <span>今日主线</span>
            <input v-model.trim="draftProfile.primaryFocus" type="text" maxlength="48" />
          </label>
          <label class="form-field">
            <span>次级推进</span>
            <input v-model.trim="draftProfile.secondaryFocus" type="text" maxlength="48" />
          </label>
          <label class="form-field">
            <span>签名</span>
            <textarea v-model.trim="draftProfile.signature" rows="3" maxlength="120"></textarea>
          </label>

          <div class="drawer-note">{{ storageNote }}</div>

          <div class="drawer-actions">
            <button class="ghost-button" type="button" @click="$emit('reset-profile')">恢复默认资料</button>
            <button class="pill-button pill-button-primary" type="submit">{{ saveLabel }}</button>
          </div>
        </section>

        <section class="drawer-section">
          <div class="drawer-section-head">
            <div>
              <p class="kicker">DATA DECK</p>
              <h4>备份、恢复和数据清理</h4>
            </div>
          </div>

          <div class="drawer-note">{{ dataSyncNote }}</div>

          <div class="data-actions">
            <button class="ghost-button" type="button" @click="$emit('export')">导出备份</button>
            <button class="ghost-button" type="button" @click="fileInputRef?.click()">导入备份</button>
            <button class="ghost-button" type="button" @click="$emit('refresh')">重新同步</button>
            <button class="ghost-button" type="button" @click="$emit('reset-history')">清空点击统计</button>
            <button class="ghost-button danger-button" type="button" @click="$emit('reset-all')">重置整个工作台</button>
            <input
              ref="fileInputRef"
              class="visually-hidden"
              type="file"
              accept="application/json"
              @change="$emit('import-change', $event)"
            />
          </div>
        </section>
      </form>
    </aside>
  </div>
</template>

<script setup>
import { ref } from "vue";

defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  draftProfile: {
    type: Object,
    required: true,
  },
  dataSyncNote: {
    type: String,
    required: true,
  },
  storageNote: {
    type: String,
    required: true,
  },
  saveLabel: {
    type: String,
    required: true,
  },
});

defineEmits([
  "close",
  "save",
  "reset-profile",
  "export",
  "import-change",
  "refresh",
  "reset-history",
  "reset-all",
]);

const fileInputRef = ref(null);
</script>
