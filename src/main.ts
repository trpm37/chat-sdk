import { createApp } from 'vue';
import App from './App.vue';

import './styles/reset.css';
import pinia from './stores';

const app=createApp(App);
app.use(pinia).mount('#app')
