import { createApp } from 'vue'
import App from './App.vue'
// Registers the Questionnaire's children (Items, follow-ups) with record-children, which Delete and Duplicate consult.
import './questionnaires'
import './style.css'

createApp(App).mount('#app')
