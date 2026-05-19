<script setup lang="ts">
import { ref, onMounted } from "vue";

type View = "auth" | "app";

const view = ref<View>("auth");
const username = ref("");
const password = ref("");
const error = ref("{}");

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
    <label for="username">Username</label>
    <input id="username" v-model="username" type="text" />
    <label for="password">Password</label>
    <input id="password" v-model="password" type="password" />
    <button @click="submit('register')">Register</button>
    <button @click="submit('login')">Log in</button>
    <p v-if="error">{{ error }}</p>
  </main>
  <main v-else>
    <h1>Welcome to the app</h1>
  </main>
</template>
