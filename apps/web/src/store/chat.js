import { create } from 'zustand'

export const useChatStore = create((set) => ({
  activeChat: null,
  setActiveChat: (chat) => set({ activeChat: chat }),
  chats: [],
  setChats: (chats) => set({ chats }),
  addMessage: (message) => set((state) => ({
    chats: state.chats.map((chat) =>
      chat.id === message.conversationId
        ? { ...chat, lastMessage: message, messages: [...(chat.messages || []), message] }
        : chat
    ),
  })),
}))
