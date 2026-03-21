<template>
  <div class="auth-shell" :class="{ open: auth.panelOpen }" :aria-hidden="!auth.panelOpen">
    <button class="auth-backdrop" type="button" aria-label="关闭账号面板" @click="$emit('close')"></button>

    <section class="auth-panel glass-panel" aria-label="账号面板">
      <div class="auth-head">
        <div>
          <p class="kicker">ACCESS CORE</p>
          <h3>{{ auth.authenticated ? "账号安全舱" : "登录工作台" }}</h3>
        </div>
        <button class="ghost-button ghost-button-square" type="button" @click="$emit('close')">X</button>
      </div>

      <p class="auth-note">
        {{
          auth.authenticated
            ? "你已经登录，可以在这里修改账号和密码。"
            : "默认账号密码是 admin / admin。登录后才能上传文件、上传音乐和查看 Docker。"
        }}
      </p>
      <p class="auth-note auth-note-strong">
        {{ auth.authenticated ? `当前已登录为 ${auth.username}` : "当前未登录" }}
      </p>

      <form v-if="!auth.authenticated" class="auth-form" @submit.prevent="$emit('login')">
        <div class="auth-fields">
          <label class="form-field">
            <span>账号</span>
            <input v-model.trim="loginForm.username" type="text" autocomplete="username" maxlength="32" />
          </label>

          <label class="form-field">
            <span>密码</span>
            <input v-model="loginForm.password" type="password" autocomplete="current-password" maxlength="64" />
          </label>
        </div>

        <div class="auth-actions">
          <button class="pill-button pill-button-primary" type="submit">登录</button>
        </div>
      </form>

      <form v-else class="auth-form" @submit.prevent="$emit('update-credentials')">
        <div class="auth-fields">
          <label class="form-field">
            <span>当前账号</span>
            <input v-model.trim="credentialForm.currentUsername" type="text" autocomplete="username" maxlength="32" />
          </label>

          <label class="form-field">
            <span>当前密码</span>
            <input v-model="credentialForm.currentPassword" type="password" autocomplete="current-password" maxlength="64" />
          </label>

          <label class="form-field">
            <span>新账号</span>
            <input v-model.trim="credentialForm.nextUsername" type="text" autocomplete="username" maxlength="32" />
          </label>

          <label class="form-field">
            <span>新密码</span>
            <input v-model="credentialForm.nextPassword" type="password" autocomplete="new-password" maxlength="64" />
          </label>
        </div>

        <div class="auth-actions">
          <button class="ghost-button" type="button" @click="$emit('logout')">退出登录</button>
          <button class="pill-button pill-button-primary" type="submit">更新账号密码</button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
defineProps({
  auth: {
    type: Object,
    required: true,
  },
  loginForm: {
    type: Object,
    required: true,
  },
  credentialForm: {
    type: Object,
    required: true,
  },
});

defineEmits(["close", "login", "logout", "update-credentials"]);
</script>
