<script setup lang="ts">
import { ref, onMounted } from "vue";

type View = "auth" | "app";

const view = ref<View>("auth");
const username = ref("");
const password = ref("");
const error = ref("");

onMounted(() => {
  if (window.location.pathname === "/app") view.value = "app";
});

/**
 * Submits a registration or login request to the server.
 * @param action The action to perform, either "register" or "login".
 * @returns {Promise<void>} Resolves when the request completes and handles redirection or error display.
 */
async function submit(action: "register" | "login") {
  error.value = "";
  const res = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.value, password: password.value }),
    redirect: "manual",
  });
  if (res.type === "opaqueredirect" || res.status === 0 || res.status === 302) {
    window.location.href = "/app";
  } else {
    const data = (await res.json()) as { error: string };
    error.value = data.error;
  }
}
</script>

<template>
  <main v-if="view === 'auth'">
    <div class="card">
      <h1>Untaingled</h1>
      <div class="field">
        <label for="username">Username</label>
        <input id="username" v-model="username" type="text" autocomplete="username" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button class="btn-secondary" @click="submit('register')">Register</button>
        <button class="btn-primary" @click="submit('login')">Log in</button>
      </div>
    </div>
  </main>
  <main v-else class="app-view">
    <h1>Welcome to the app</h1>
  </main>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 16px;
  line-height: 1.5;
  background: #f5f5f5;
  color: #1a1a1a;
}
</style>

<style scoped>
main {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 2rem;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #444;
}

input {
  padding: 0.5rem 0.625rem;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  background: #fff;
  color: #1a1a1a;
  transition: border-color 0.15s;
}

input:focus {
  outline: none;
  border-color: #555;
}

.error {
  margin: 0;
  font-size: 0.875rem;
  color: #c0392b;
}

.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.25rem;
}

button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.9375rem;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.btn-primary {
  background: #1a1a1a;
  color: #fff;
  border: 1px solid #1a1a1a;
}

.btn-primary:hover {
  background: #333;
  border-color: #333;
}

.btn-secondary {
  background: #fff;
  color: #1a1a1a;
  border: 1px solid #d0d0d0;
}

.btn-secondary:hover {
  background: #f5f5f5;
}

.app-view h1 {
  font-size: 1.5rem;
  font-weight: 600;
}
</style>
