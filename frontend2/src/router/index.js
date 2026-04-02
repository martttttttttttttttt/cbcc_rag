import { createRouter, createWebHistory } from 'vue-router'
import Chat from '../components/Chat.vue'
import PDFList from '../components/PDFList.vue'

const routes = [
  {
    path: '/',
    name: 'chat',
    component: Chat
  },
  {
    path: '/pdf-list',
    name: 'pdf-list',
    component: PDFList
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router